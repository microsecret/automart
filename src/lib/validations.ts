import { z } from "zod"

export const registerSchema = z.object({
  name: z.string().min(2, "Имя минимум 2 символа").max(50),
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль минимум 6 символов").max(100),
})

export const listingCreateSchema = z.object({
  title: z.string().min(3, "Заголовок обязателен").max(200),
  price: z.number().min(0, "Цена должна быть положительной"),
  vehicleId: z.string().uuid().optional(),
  partId: z.string().uuid().optional(),
  description: z.string().max(5000).optional(),
}).refine(
  ({ vehicleId, partId }) => Boolean(vehicleId) !== Boolean(partId),
  { message: "Выберите ровно один тип объявления: транспорт или запчасть" },
)

export const partCreateSchema = z.object({
  name: z.string().min(2).max(200),
  price: z.number().min(0),
  condition: z.string().optional(),
  partType: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
})

export const messageSchema = z.object({
  receiverId: z.string().uuid(),
  content: z.string().min(1, "Сообщение не может быть пустым").max(5000),
})

export const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(2000).optional(),
  listingId: z.string().uuid().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type ListingCreateInput = z.infer<typeof listingCreateSchema>
