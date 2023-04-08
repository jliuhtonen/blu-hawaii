import { Response } from "got"
import { Observable, defer, switchMap, throwError, of, retry } from "rxjs"

export function asRetryable<T>(
  fn: () => Promise<Response<T>>,
  delayMillis = 10000,
): Observable<T> {
  return defer(fn).pipe(
    switchMap((response) => {
      if (!response.ok) {
        return throwError(
          () => new Error(`Non-ok status code ${response.statusCode}`),
        )
      }

      return of(response.body)
    }),
    retry({ delay: delayMillis }),
  )
}
