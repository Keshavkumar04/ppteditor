import { createContext, useContext, ReactNode } from 'react'

interface CommentsContextValue {
  slideCommentCounts: Record<string, number>
  onSlideCommentBadgeClick?: (slideId: string) => void
}

const CommentsContext = createContext<CommentsContextValue>({
  slideCommentCounts: {},
})

export interface CommentsProviderProps {
  slideCommentCounts?: Record<string, number>
  onSlideCommentBadgeClick?: (slideId: string) => void
  children: ReactNode
}

export function CommentsProvider({
  slideCommentCounts,
  onSlideCommentBadgeClick,
  children,
}: CommentsProviderProps) {
  return (
    <CommentsContext.Provider
      value={{
        slideCommentCounts: slideCommentCounts ?? {},
        onSlideCommentBadgeClick,
      }}
    >
      {children}
    </CommentsContext.Provider>
  )
}

export function useComments() {
  return useContext(CommentsContext)
}
