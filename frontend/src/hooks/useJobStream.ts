import { useEffect, useState, useRef } from 'react'
import { SSEUpdate, PipelineStage } from '../types'
import { isDemoMode } from '../demoConfig'

interface UseJobStreamResult {
  stage: PipelineStage
  progress: number
  message: string
  error?: string
  isComplete: boolean
  isFailed: boolean
}

const DEMO_STAGES: PipelineStage[] = [
  'queued',
  'disease_analysis',
  'target_discovery',
  'molecular_generation',
  'docking',
  'insight_synthesis',
  'completed'
]

export function useJobStream(jobId: string | null): UseJobStreamResult {
  const [state, setState] = useState<UseJobStreamResult>({
    stage: 'queued',
    progress: 0,
    message: 'Waiting to start...',
    isComplete: false,
    isFailed: false,
  })
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    setState({
      stage: 'queued',
      progress: 0,
      message: 'Waiting to start...',
      isComplete: false,
      isFailed: false,
    })

    if (!jobId) return

    if (isDemoMode()) {
      let currentStageIdx = 1; // start at disease_analysis immediately, skip queued
      let currentProgress = 0;
      
      const timer = setInterval(() => {
        if (currentStageIdx >= DEMO_STAGES.length - 1) {
          setState({
            stage: 'completed',
            progress: 100,
            message: 'Pipeline complete',
            isComplete: true,
            isFailed: false,
          });
          clearInterval(timer);
          return;
        }

        currentProgress += 5;
        if (currentProgress > 100) {
          currentProgress = 0;
          currentStageIdx += 1;
        }

        const nextStage = DEMO_STAGES[currentStageIdx];
        setState({
          stage: nextStage,
          progress: nextStage === 'completed' ? 100 : currentProgress,
          message: `Simulating ${nextStage}...`,
          isComplete: nextStage === 'completed',
          isFailed: false,
        });
      }, 200);

      return () => clearInterval(timer);
    }

    const es = new EventSource(`/api/stream/${jobId}`)
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const update: SSEUpdate = JSON.parse(event.data)
        const isComplete = update.stage === 'completed'
        const isFailed = update.stage === 'failed' || !!update.error
        setState({
          stage: update.stage,
          progress: update.progress,
          message: update.message,
          error: update.error,
          isComplete,
          isFailed,
        })
        if (isComplete || isFailed) {
          es.close()
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      setState((prev) => ({
        ...prev,
        isFailed: true,
        error: 'Connection to server lost',
      }))
      es.close()
    }

    return () => {
      es.close()
    }
  }, [jobId])

  return state
}
