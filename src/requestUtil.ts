import { Observable, defer, retry } from "rxjs"

export function asRetryable<T>(
  fn: () => Promise<T>,
  delayMillis = 10000,
): Observable<T> {
  return defer(fn).pipe(retry({ delay: delayMillis }))
}
