import { db } from "@/drizzle/db"
import { QuestionTable } from "@/drizzle/schema"
import { getJobInfoIdTag } from "@/features/jobInfos/dbCache"
import { updateQuestion } from "@/features/questions/db"
import { getQuestionIdTag } from "@/features/questions/dbCache"
import { generateAiQuestionFeedback } from "@/services/ai/questions"
import { getCurrentUser } from "@/services/clerk/lib/getCurrentUser"
import { eq } from "drizzle-orm"
import { cacheTag } from "next/dist/server/use-cache/cache-tag"
import z from "zod"

const schema = z.object({
  prompt: z.string().min(1),
  questionId: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json()
  const result = schema.safeParse(body)

  if (!result.success) {
    return new Response("Error generating your feedback", { status: 400 })
  }

  const { prompt: answer, questionId } = result.data
  const { userId } = await getCurrentUser()

  if (userId == null) {
    return new Response("You are not logged in", { status: 401 })
  }

  const question = await getQuestion(questionId, userId)
  if (question == null) {
    return new Response("You do not have permission to do this", {
      status: 403,
    })
  }

  const trimmedAnswer = answer.trim()

  await updateQuestion(questionId, {
    answer: trimmedAnswer,
  })

  const res = generateAiQuestionFeedback({
    question: question.text,
    answer: trimmedAnswer,
    onFinish: async feedback => {
      const rating = parseFeedbackRating(feedback)
      await updateQuestion(questionId, {
        feedback,
        feedbackRating: rating ?? null,
      })
    },
  })

  return res.toDataStreamResponse({ sendUsage: false })
}

function parseFeedbackRating(feedback: string) {
  const match = feedback.match(/##\s+Feedback\s*\(Rating:\s*(\d{1,2})\/10\)/i)
  if (match == null) return null

  const rating = Number(match[1])
  if (Number.isNaN(rating) || rating < 0 || rating > 10) {
    return null
  }

  return rating
}

async function getQuestion(id: string, userId: string) {
  "use cache"
  cacheTag(getQuestionIdTag(id))

  const question = await db.query.QuestionTable.findFirst({
    where: eq(QuestionTable.id, id),
    with: { jobInfo: { columns: { id: true, userId: true } } },
  })

  if (question == null) return null
  cacheTag(getJobInfoIdTag(question.jobInfo.id))

  if (question.jobInfo.userId !== userId) return null
  return question
}
