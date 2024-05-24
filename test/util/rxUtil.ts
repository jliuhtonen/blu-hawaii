import { Observable } from "rxjs"

export const gatherObservableResults = <T>(
  observable: Observable<T>,
  numberOfResults: number,
  timeout = 5000,
): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const results: T[] = []
    const subscription = observable.subscribe({
      next(result: T) {
        results.push(result)
        if (results.length === numberOfResults) {
          subscription.unsubscribe()
          resolve(results)
        }
      },
      error(error: Error) {
        subscription.unsubscribe()
        reject(error)
      },
      complete() {
        subscription.unsubscribe()
        resolve(results)
      },
    })

    setTimeout(() => {
      subscription.unsubscribe()
      resolve(results)
    }, timeout)
  })
}
