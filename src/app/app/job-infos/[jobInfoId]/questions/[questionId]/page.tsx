import { BackLink } from "@/components/BackLink"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { db } from "@/drizzle/db"
import { QuestionTable } from "@/drizzle/schema"
import { getJobInfoIdTag } from "@/features/jobInfos/dbCache"
import { formatQuestionDifficulty } from "@/features/questions/formatters"
import { getQuestionIdTag } from "@/features/questions/dbCache"
import { formatDateTime } from "@/lib/formatters"
import { getCurrentUser } from "@/services/clerk/lib/getCurrentUser"
import { and, eq } from "drizzle-orm"
import { cacheTag } from "next/dist/server/use-cache/cache-tag"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ jobInfoId: string; questionId: string }>
}) {
  const { jobInfoId, questionId } = await params

  const { userId, redirectToSignIn } = await getCurrentUser()
  if (userId == null) return redirectToSignIn()

  const question = await getQuestion(jobInfoId, questionId, userId)
  if (question == null) return notFound()

  return (
    <div className="container py-4 space-y-4 h-screen-header flex flex-col">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <BackLink href={`/app/job-infos/${jobInfoId}/questions`}>
            Questions
          </BackLink>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge>{formatQuestionDifficulty(question.difficulty)}</Badge>
            {question.feedbackRating != null && (
              <Badge variant="secondary">{question.feedbackRating}/10</Badge>
            )}
          </div>
        </div>
      </div>

      <ResizablePanelGroup
        direction="horizontal"
        className="flex-grow border rounded-md"
      >
        <ResizablePanel id="question-and-feedback" defaultSize={50} minSize={5}>
          <ResizablePanelGroup direction="vertical" className="flex-grow">
            <ResizablePanel id="question" defaultSize={35} minSize={5}>
              <ScrollArea className="h-full min-w-48 *:h-full">
                <MarkdownRenderer className="p-6">
                  {question.text}
                </MarkdownRenderer>
              </ScrollArea>
            </ResizablePanel>
            {question.feedback && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel id="feedback" defaultSize={65} minSize={5}>
                  <ScrollArea className="h-full min-w-48 *:h-full">
                    <MarkdownRenderer className="p-6">
                      {question.feedback}
                    </MarkdownRenderer>
                  </ScrollArea>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="answer" defaultSize={50} minSize={5}>
          <ScrollArea className="h-full min-w-48 *:h-full">
            <div className="p-6 whitespace-pre-wrap text-base">
              {question.answer}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

async function getQuestion(
  jobInfoId: string,
  questionId: string,
  userId: string,
) {
  "use cache"
  cacheTag(getQuestionIdTag(questionId))

  const question = await db.query.QuestionTable.findFirst({
    where: and(
      eq(QuestionTable.id, questionId),
      eq(QuestionTable.jobInfoId, jobInfoId),
    ),
    columns: {
      id: true,
      text: true,
      difficulty: true,
      answer: true,
      feedback: true,
      feedbackRating: true,
      updatedAt: true,
    },
    with: {
      jobInfo: {
        columns: {
          id: true,
          userId: true,
        },
      },
    },
  })

  if (question == null) return null

  cacheTag(getJobInfoIdTag(question.jobInfo.id))

  if (question.jobInfo.userId !== userId) return null

  if (!question.answer || !question.feedback) {
    return null
  }

  return {
    id: question.id,
    text: question.text,
    answer: question.answer,
    feedback: question.feedback,
    difficulty: question.difficulty,
    feedbackRating: question.feedbackRating,
    updatedAt: question.updatedAt,
  }
}
