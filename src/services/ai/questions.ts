import {
  JobInfoTable,
  QuestionDifficulty,
  QuestionTable,
} from "@/drizzle/schema"
import { CoreMessage, streamText } from "ai"
import { google } from "./models/google"

export function generateAiQuestion({
  jobInfo,
  previousQuestions,
  difficulty,
  onFinish,
}: {
  jobInfo: Pick<
    typeof JobInfoTable.$inferSelect,
    "title" | "description" | "experienceLevel"
  >
  previousQuestions: Pick<
    typeof QuestionTable.$inferSelect,
    "text" | "difficulty"
  >[]
  difficulty: QuestionDifficulty
  onFinish: (question: string) => void
}) {
  const previousMessages = previousQuestions.flatMap(
    q =>
      [
        { role: "user", content: q.difficulty },
        { role: "assistant", content: q.text },
      ] satisfies CoreMessage[],
  )

  return streamText({
    model: google("gemini-2.5-flash"),
    onFinish: ({ text }) => onFinish(text),
    messages: [
      ...previousMessages,
      {
        role: "user",
        content: difficulty,
      },
    ],
    maxSteps: 10,
    experimental_continueSteps: true,
    system: `You are an AI assistant that creates technical interview questions tailored to a specific job role. Your task is to generate one **realistic and relevant** technical question that matches the skill requirements of the job and aligns with the difficulty level provided by the user.

Job Information:
- Job Description: \`${jobInfo.description}\`
- Experience Level: \`${jobInfo.experienceLevel}\`
${jobInfo.title ? `\n- Job Title: \`${jobInfo.title}\`` : ""}

Guidelines:
- The question must reflect the skills and technologies mentioned in the job description.
- Make sure the question is appropriately scoped for the specified experience level.
- A difficulty level of "easy", "medium", or "hard" is provided by the user and should be used to tailor the question.
- Prefer practical, real-world challenges over trivia.
- Return only the question, clearly formatted (e.g., with code snippets or bullet points if needed). Do not include the answer.
- Return only one question at a time.
- It is ok to ask a question about just a single part of the job description, such as a specific technology or skill (e.g., if the job description is for a Next.js, Drizzle, and TypeScript developer, you can ask a TypeScript only question).
- The question should be formatted as markdown.
- Stop generating output as soon you have provided the full question.`,
  })
}

export function generateAiQuestionFeedback({
  question,
  answer,
  onFinish,
}: {
  question: string
  answer: string
  onFinish?: (feedback: string) => void | Promise<void>
}) {
  return streamText({
    model: google("gemini-2.5-flash"),
    prompt: answer,
    maxSteps: 10,
    experimental_continueSteps: true,
    system: `You are an expert technical interviewer. Your job is to evaluate the candidate's answer to a technical interview question.

The original question was:
\`\`\`
${question}
\`\`\`

Instructions:
- Review the candidate's answer (provided in the user prompt).
- Assign a rating from **1 to 10**, where:
  - 10 = Perfect, complete, and well-articulated
  - 7-9 = Mostly correct, with minor issues or room for optimization
  - 4-6 = Partially correct or incomplete
  - 1-3 = Largely incorrect or missing the point
- Provide **concise, constructive feedback** on what was done well and what could be improved.
- Be honest but professional.
- Include a full correct answer in the output. Do not use this answer as part of the grading. Only look at the candidate's response when assigning a rating.
- Try to generate a concise answer where possible, but do not sacrifice quality for brevity.
- Refer to the candidate as "you" in your feedback. This feedback should be written as if you were speaking directly to the interviewee.
- Stop generating output as soon you have provided the rating, feedback, and full correct answer.

Output Format (strictly follow this structure):
\`\`\`
## Feedback (Rating: <Your rating from 1 to 10>/10)
<Your written feedback as markdown>
---
## Correct Answer
<The full correct answer as markdown>
\`\`\``,
    onFinish: async ({ text }) => {
      if (onFinish != null) {
        await onFinish(text)
      }
    },
  })
}
