"use client";

import { useRef, useState } from "react";
import { type SuggestionItem, Suggestions } from "./input/suggestions";
import { InputBar } from "./input-bar";
import { MessageList } from "./message-list";
import type { AgentChatProps } from "./types";
import { cn } from "./utils/cn";

export function AgentChat({
  messages,
  onSend,
  status,
  onStop,
  error,
  classNames,
  slots,
  toolRenderers,
  attachments,
  showCopyToolbar,
  initialScrollBehavior,
  enableImagePreview,
  suggestions,
  emptyState,
  emptyStatePosition = "default",
  emptySuggestionsPlacement = "input",
  emptySuggestionsPosition = "top",
  questionTool,
  className,
  style,
}: AgentChatProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const ResolvedInputBar = slots?.InputBar ?? InputBar;
  const isEmpty = !error && messages.length === 0;
  const isCenteredEmptyState = isEmpty && emptyStatePosition === "center";
  const showEmptyPlaceholder =
    isEmpty && !isCenteredEmptyState && Boolean(emptyState);

  const pendingQuestion = findPendingQuestion(messages, questionTool);
  const suggestionConfig = resolveSuggestions(suggestions);
  const showInputSuggestions =
    emptySuggestionsPlacement === "input" ||
    emptySuggestionsPlacement === "both";
  const showEmptySuggestions =
    isCenteredEmptyState &&
    (emptySuggestionsPlacement === "empty" ||
      emptySuggestionsPlacement === "both") &&
    suggestionConfig.items.length > 0;

  const handleEmptySuggestionSelect = (item: SuggestionItem) => {
    setDraft(item.value ?? item.label);
  };

  const emptySuggestionsNode = showEmptySuggestions ? (
    <Suggestions
      className={cn(
        "w-full justify-center",
        emptySuggestionsPosition === "top" ? "mb-3" : "mt-3",
        suggestionConfig.className
      )}
      disabled={status === "streaming" || status === "submitted"}
      itemClassName={cn("h-8 rounded-md px-3", suggestionConfig.itemClassName)}
      items={suggestionConfig.items}
      onSelect={handleEmptySuggestionSelect}
    />
  ) : null;

  const inputBarNode = (
    <ResolvedInputBar
      attachedFiles={attachments?.files}
      attachedImages={attachments?.images}
      className={cn(classNames?.inputBar, isCenteredEmptyState && "px-0 pb-0")}
      isDragOver={attachments?.isDragOver}
      onAttach={attachments?.onAttach}
      onChange={setDraft}
      onPaste={attachments?.onPaste}
      onRemoveFile={attachments?.onRemoveFile}
      onRemoveImage={attachments?.onRemoveImage}
      onSend={onSend}
      onStop={onStop}
      placeholder="Send a message..."
      questionBar={
        pendingQuestion
          ? {
              id: pendingQuestion.id,
              questions: pendingQuestion.questions,
              questionIndex: pendingQuestion.questionIndex,
              totalQuestions: pendingQuestion.totalQuestions,
              onPreviousQuestion: pendingQuestion.onPreviousQuestion,
              onNextQuestion: pendingQuestion.onNextQuestion,
              submitLabel: pendingQuestion.submitLabel,
              skipLabel: pendingQuestion.skipLabel,
              allowSkip: pendingQuestion.allowSkip,
              onSubmit: (answer) => {
                questionTool?.onAnswer?.({
                  toolCallId: pendingQuestion.toolCallId,
                  question:
                    pendingQuestion.questions[
                      pendingQuestion.questionIndex
                        ? pendingQuestion.questionIndex - 1
                        : 0
                    ],
                  answer,
                });
              },
            }
          : undefined
      }
      status={status}
      suggestions={showInputSuggestions ? suggestions : []}
      value={draft}
    />
  );

  const centeredEmptyNode = (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-4">
      <div className="w-full max-w-an">
        {emptySuggestionsPosition === "top" ? emptySuggestionsNode : null}
        {inputBarNode}
        {emptySuggestionsPosition === "bottom" ? emptySuggestionsNode : null}
      </div>
    </div>
  );

  const emptyPlaceholderNode = (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-6">
      {emptyState}
    </div>
  );

  const messageListNode = (
    <MessageList
      classNames={classNames}
      enableImagePreview={enableImagePreview}
      initialScrollBehavior={initialScrollBehavior}
      messages={
        error
          ? [
              ...messages,
              {
                id: "agent-chat-error",
                role: "assistant",
                parts: [
                  {
                    type: "error",
                    title: "Request failed",
                    message: error.message,
                  },
                ],
              } as unknown as (typeof messages)[number],
            ]
          : messages
      }
      showCopyToolbar={showCopyToolbar}
      slots={slots}
      status={status}
      suppressQuestionTool={Boolean(pendingQuestion)}
      toolRenderers={toolRenderers}
    />
  );

  let feedNode = messageListNode;
  if (isCenteredEmptyState) {
    feedNode = centeredEmptyNode;
  } else if (showEmptyPlaceholder) {
    feedNode = emptyPlaceholderNode;
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        classNames?.root,
        className
      )}
      ref={rootRef}
      style={style}
    >
      {feedNode}
      {isCenteredEmptyState ? null : inputBarNode}
    </div>
  );
}

function resolveSuggestions(suggestions: AgentChatProps["suggestions"]) {
  if (Array.isArray(suggestions)) {
    return {
      items: suggestions,
      className: undefined,
      itemClassName: undefined,
    };
  }
  return {
    items: suggestions?.items ?? [],
    className: suggestions?.className,
    itemClassName: suggestions?.itemClassName,
  };
}

function findPendingQuestion(
  messages: AgentChatProps["messages"],
  questionTool: AgentChatProps["questionTool"]
) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;
    const parts = message.parts ?? [];
    for (let p = parts.length - 1; p >= 0; p -= 1) {
      const part = parts[p] as {
        type?: string;
        toolCallId?: string;
        input?: {
          questions?: import("./question/question-prompt").QuestionConfig[];
          question?: import("./question/question-prompt").QuestionConfig;
          questionIndex?: number;
          totalQuestions?: number;
          onPreviousQuestion?: () => void;
          onNextQuestion?: () => void;
          submitLabel?: string;
          skipLabel?: string;
          allowSkip?: boolean;
        };
        output?: {
          answer?: import("./question/question-prompt").QuestionAnswer;
        };
      };
      if (part?.type !== "tool-Question") continue;
      const input = part.input;
      const questions = input?.questions ?? [];
      const firstQuestion = questions[0] ?? input?.question;
      if (!firstQuestion) continue;
      if (part.output?.answer) return null;
      return {
        id: part.toolCallId ?? `question-${i}-${p}`,
        toolCallId: part.toolCallId,
        questions,
        question: firstQuestion,
        questionIndex: input?.questionIndex,
        totalQuestions:
          input?.totalQuestions ??
          (questions.length > 0 ? questions.length : undefined),
        onPreviousQuestion: input?.onPreviousQuestion,
        onNextQuestion: input?.onNextQuestion,
        submitLabel: questionTool?.submitLabel ?? input?.submitLabel,
        skipLabel: questionTool?.skipLabel ?? input?.skipLabel,
        allowSkip: questionTool?.allowSkip ?? input?.allowSkip,
      };
    }
  }
  return null;
}

// Legacy component alias kept for compatibility.
export const AnAgentChat = AgentChat;
