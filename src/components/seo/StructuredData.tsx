type StructuredDataProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>
}

function serializeStructuredData(data: StructuredDataProps["data"]) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export default function StructuredData({ data }: StructuredDataProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }} />
}
