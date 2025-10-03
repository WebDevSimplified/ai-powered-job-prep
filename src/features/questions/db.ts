import { db } from "@/drizzle/db"
import { QuestionTable } from "@/drizzle/schema"
import { eq } from "drizzle-orm"
import { revalidateQuestionCache } from "./dbCache"

export async function insertQuestion(
  question: typeof QuestionTable.$inferInsert,
) {
  const [newQuestion] = await db
    .insert(QuestionTable)
    .values(question)
    .returning({
      id: QuestionTable.id,
      jobInfoId: QuestionTable.jobInfoId,
    })

  revalidateQuestionCache({
    id: newQuestion.id,
    jobInfoId: newQuestion.jobInfoId,
  })

  return newQuestion
}

export async function updateQuestion(
  id: string,
  question: Partial<typeof QuestionTable.$inferInsert>,
) {
  const [updatedQuestion] = await db
    .update(QuestionTable)
    .set(question)
    .where(eq(QuestionTable.id, id))
    .returning({
      id: QuestionTable.id,
      jobInfoId: QuestionTable.jobInfoId,
    })

  revalidateQuestionCache({
    id: updatedQuestion.id,
    jobInfoId: updatedQuestion.jobInfoId,
  })

  return updatedQuestion
}
