import { useMutation, useQueryClient } from '@tanstack/react-query'
import { questionsApi } from '@/services/questions-api'

export function useCompletePractice(questionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { userAnswer: string; timeSpent: number }) => questionsApi.completePractice(questionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['question', questionId] })
      void queryClient.invalidateQueries({ queryKey: ['question-attempts', questionId] })
      void queryClient.invalidateQueries({ queryKey: ['questions'] })
      void queryClient.invalidateQueries({ queryKey: ['m-questions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['practice-trend'] })
      void queryClient.invalidateQueries({ queryKey: ['recent-completed-questions'] })
      void queryClient.invalidateQueries({ queryKey: ['incomplete-questions'] })
      void queryClient.invalidateQueries({ queryKey: ['learning'] })
    },
  })
}
