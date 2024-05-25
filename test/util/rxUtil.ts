import { Observable } from "rxjs"

export const gatherObservableResults = <T>(
  observable: Observable<T>,
  numberOfResults: number,
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
        if (results.length === numberOfResults) {
          subscription.unsubscribe()
          onComplete()
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
      reject(
        new Error(
          `Timeout after ${timeout} milliseconds waiting for observable results`,
        ),
      )
    }, timeout)
  })
}
