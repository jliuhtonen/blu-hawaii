import { Observable } from "rxjs"
import assert from "node:assert"

export const assertObservableResults = <T>(
  observable: Observable<T>,
  expectedResults: T[],
  timeout = 5000,
): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    let timeoutRef: NodeJS.Timeout | undefined
    const results: T[] = []

    const onComplete = () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef)
      }
      resolve(results)
    }

    const onError = (error: Error) => {
      if (timeoutRef) {
        clearTimeout(timeoutRef)
      }
      reject(error)
    }

    const subscription = observable.subscribe({
      next(result: T) {
        results.push(result)
        if (results.length < expectedResults.length) {
          return
        }
        try {
          assert.deepEqual(expectedResults, results)
          subscription.unsubscribe()
          onComplete()
        } catch (error) {
          onError(error)
        }
      },
      error(error: Error) {
        subscription.unsubscribe()
        onError(error)
      },
      complete() {
        subscription.unsubscribe()
        onComplete()
      },
    })

    timeoutRef = setTimeout(() => {
      subscription.unsubscribe()
      if (expectedResults.length === 0) {
        onComplete()
      } else {
        reject(
          new Error(
            `Timeout after ${timeout} milliseconds waiting for observable results, got ${JSON.stringify(results, null, 2)}`,
          ),
        )
      }
    }, timeout)
  })
}
