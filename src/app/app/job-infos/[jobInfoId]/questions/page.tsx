import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { db } from "@/drizzle/db"
import { JobInfoTable, QuestionTable } from "@/drizzle/schema"
import { JobInfoBackLink } from "@/features/jobInfos/components/JobInfoBackLink"
import { getJobInfoIdTag } from "@/features/jobInfos/dbCache"
import { formatExperienceLevel } from "@/features/jobInfos/lib/formatters"
import { formatQuestionDifficulty } from "@/features/questions/formatters"
import { getQuestionJobInfoTag } from "@/features/questions/dbCache"
import { canCreateQuestion } from "@/features/questions/permissions"
import { formatDateTime } from "@/lib/formatters"
import { getCurrentUser } from "@/services/clerk/lib/getCurrentUser"
import { and, desc, eq, isNotNull } from "drizzle-orm"
import { ArrowRightIcon, GaugeIcon, Loader2Icon, PlusIcon } from "lucide-react"
import { cacheTag } from "next/dist/server/use-cache/cache-tag"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

export default async function QuestionsPage({
  params,
}: {
  params: Promise<{ jobInfoId: string }>
}) {
  const { jobInfoId } = await params

  return (
    <div className="container py-4 gap-4 h-screen-header flex flex-col items-start">
      <JobInfoBackLink jobInfoId={jobInfoId} />

      <Suspense
        fallback={<Loader2Icon className="size-24 animate-spin m-auto" />}
      >
        <QuestionsDashboard jobInfoId={jobInfoId} />
      </Suspense>
    </div>
  )
}

async function QuestionsDashboard({ jobInfoId }: { jobInfoId: string }) {
  const { userId, redirectToSignIn } = await getCurrentUser()
  if (userId == null) return redirectToSignIn()

  const [jobInfo, questions, canCreate] = await Promise.all([
    getJobInfo(jobInfoId, userId),
    getCompletedQuestions(jobInfoId, userId),
    canCreateQuestion(),
  ])

  if (jobInfo == null) return notFound()

  const newQuestionHref = canCreate
    ? `/app/job-infos/${jobInfoId}/questions/new`
    : `/app/upgrade`

  return (
    <div className="space-y-6 w-full">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl lg:text-5xl">Questions</h1>
            <p className="text-muted-foreground">
              Review your completed practice questions for {jobInfo.name}.
            </p>
          </div>
          <Button asChild variant={canCreate ? "default" : "outline"}>
            <Link href={newQuestionHref}>
              <PlusIcon className="mr-2" />
              New Question
            </Link>
          </Button>
        </div>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">
            {formatExperienceLevel(jobInfo.experienceLevel)}
          </Badge>
          {jobInfo.title && <Badge variant="outline">{jobInfo.title}</Badge>}
        </div>
      </header>

      {questions.length === 0 ? (
        <EmptyState href={newQuestionHref} canCreate={canCreate} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 has-hover:*:not-hover:opacity-70">
          <Link className="transition-opacity" href={newQuestionHref}>
            <Card className="h-full flex items-center justify-center border-dashed border-3 bg-transparent hover:border-primary/50 transition-colors shadow-none">
              <div className="text-lg flex items-center gap-2">
                <PlusIcon className="size-6" />
                New Question
              </div>
            </Card>
          </Link>
          {questions.map(question => (
            <Link
              key={question.id}
              className="hover:scale-[1.02] transition-[transform_opacity]"
              href={`/app/job-infos/${jobInfoId}/questions/${question.id}`}
            >
              <Card className="h-full">
                <div className="flex items-center justify-between h-full">
                  <CardHeader className="gap-2 flex-grow">
                    <CardTitle className="text-lg flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{formatDateTime(question.createdAt)}</span>
                      <Badge variant="secondary">
                        {formatQuestionDifficulty(question.difficulty)}
                      </Badge>
                      {question.feedbackRating != null && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <GaugeIcon className="size-4" />
                          {question.feedbackRating}/10
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {question.text}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center">
                    <ArrowRightIcon className="size-6" />
                  </CardContent>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ href, canCreate }: { href: string; canCreate: boolean }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>No completed questions yet</CardTitle>
        <CardDescription>
          Generate a question, write your answer, and request feedback to see it
          here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant={canCreate ? "default" : "outline"}>
          <Link href={href}>
            <PlusIcon className="mr-2" />
            {canCreate ? "Ask your first question" : "Upgrade to continue"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

async function getJobInfo(id: string, userId: string) {
  "use cache"
  cacheTag(getJobInfoIdTag(id))

  return db.query.JobInfoTable.findFirst({
    where: and(eq(JobInfoTable.id, id), eq(JobInfoTable.userId, userId)),
    columns: {
      id: true,
      name: true,
      title: true,
      experienceLevel: true,
    },
  })
}

async function getCompletedQuestions(jobInfoId: string, userId: string) {
  "use cache"
  cacheTag(getQuestionJobInfoTag(jobInfoId))

  const data = await db.query.QuestionTable.findMany({
    where: and(
      eq(QuestionTable.jobInfoId, jobInfoId),
      isNotNull(QuestionTable.answer),
      isNotNull(QuestionTable.feedback),
    ),
    columns: {
      id: true,
      text: true,
      difficulty: true,
      feedbackRating: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      jobInfo: {
        columns: { userId: true },
      },
    },
    orderBy: desc(QuestionTable.updatedAt),
  })

  return data
    .filter(question => question.jobInfo.userId === userId)
    .map(question => ({
      id: question.id,
      text: question.text,
      difficulty: question.difficulty,
      feedbackRating: question.feedbackRating,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    }))
}
