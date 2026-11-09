"""Server-only regression checks. All locks are on disposable SQLite files."""

import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import time


ROOT = Path(__file__).resolve().parents[1]
NODE_WRITER = r"""
const readline = require('node:readline/promises')
const { readFileSync } = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient({ datasources: { db: { url: process.env.LOCK_TEST_URL } } })
const helper = new Module('fuel-import-log-batch', module)
helper.paths = module.paths
helper._compile(ts.transpileModule(readFileSync('src/lib/fuel-import-log-batch.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, 'fuel-import-log-batch')
const entry = { runId: 'fixture', source: 'probe', city: 'Москва', station: 'АЗС «Тест»',
  address: null, prices: 'АИ-95 60,00', status: null, kind: 'STATION' }
const insert = process.argv[1] === 'legacy'
  ? () => db.fuelImportLogEntry.createMany({ data: [entry, entry] })
  : () => helper.exports.insertFuelStationLogBatch(db, [entry, entry])
const input = readline.createInterface({ input: process.stdin })
;(async () => {
  try {
    await insert()
    console.log('unexpected success')
  } catch (error) {
    console.log(error.code || error.message.split('\n').at(-1), error.meta?.message || '')
  }
  await input.question('')
  try {
    await insert()
    const rows = await db.fuelImportLogEntry.findMany()
    console.log('retry ' + rows.length + ' ' + rows[0].station)
  } catch (error) {
    console.log('retry ' + (error.code || error.message.split('\n').at(-1)))
  } finally {
    input.close()
    await db.$disconnect()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
"""


def verify_batch(folder, mode):
    db = folder / f'{mode}.db'
    reader = sqlite3.connect(db, timeout=1)
    reader.execute('CREATE TABLE FuelImportRun (id TEXT PRIMARY KEY)')
    reader.executescript((ROOT / 'prisma/migrations/20260831140000_fuel_import_log/migration.sql').read_text(encoding='utf-8'))
    reader.execute("INSERT INTO FuelImportRun VALUES ('fixture')")
    reader.commit()
    reader.execute('BEGIN')
    reader.execute('SELECT COUNT(*) FROM FuelImportLogEntry').fetchone()
    env = {**os.environ, 'LOCK_TEST_URL': f'file:{db}?connection_limit=1&socket_timeout=1'}
    with subprocess.Popen(['node', '-e', NODE_WRITER, mode], cwd=ROOT, env=env,
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True) as writer:
        try:
            first = writer.stdout.readline().strip()
            assert first == 'P1008' or 'locked' in first.lower(), first
            reader.rollback()
            try:
                assert reader.execute('SELECT COUNT(*) FROM FuelImportLogEntry').fetchone() == (0,)
                locked = False
            except sqlite3.OperationalError as error:
                assert error.sqlite_errorcode == sqlite3.SQLITE_BUSY, error
                locked = True
            out, _ = writer.communicate('continue\n', timeout=10)
            assert writer.returncode == 0, out
            if mode == 'legacy':
                assert locked and 'SQL error or missing database' in out, out
            else:
                assert not locked and out.strip() == 'retry 2 АЗС «Тест»', out
            print(f'{mode}: first={first}, lock_after_reader_released={locked}, {out.strip()}')
        finally:
            if writer.poll() is None:
                writer.kill()
            reader.close()


def verify_watchdog(folder):
    db = folder / 'watchdog.db'
    with sqlite3.connect(db) as conn:
        conn.execute('CREATE TABLE fixture (value INTEGER)')
        conn.execute('INSERT INTO fixture VALUES (1)')
    systemctl = folder / 'systemctl'
    systemctl.write_text('#!/bin/sh\n[ "$1" = show ] || exit 99\nprintf "%s\\n" "$WATCHDOG_TEST_PID"\n')
    systemctl.chmod(0o700)
    env = {**os.environ, 'PATH': f'{folder}:{os.environ["PATH"]}',
           'AUTOMART_DB_PATH': str(db), 'AUTOMART_DB_STUCK_SECONDS': '1',
           'AUTOMART_DB_WATCHDOG_DRY_RUN': '1', 'AUTOMART_DB_WATCHDOG_STATE': str(folder / 'last'),
           'WATCHDOG_TEST_PID': str(os.getpid())}
    for mode, expected in [('IMMEDIATE', False), ('EXCLUSIVE', True)]:
        with sqlite3.connect(db) as owner:
            owner.execute(f'BEGIN {mode}')
            owner.execute('UPDATE fixture SET value = value + 1')
            old = time.time() - 60
            os.utime(str(db) + '-journal', (old, old))
            result = subprocess.run(['bash', 'scripts/db-lock-watchdog.sh'], cwd=ROOT, env=env,
                                    check=True, capture_output=True, text=True, timeout=12)
            assert ('ПРОБНЫЙ ЗАПУСК' in result.stdout) == expected, result.stdout
            owner.rollback()
            print(f'watchdog {mode}: restart_candidate={expected}')


with tempfile.TemporaryDirectory(prefix='lewheel-lock-regression-') as temp:
    folder = Path(temp)
    verify_batch(folder, 'legacy')
    verify_batch(folder, 'fixed')
    verify_watchdog(folder)
