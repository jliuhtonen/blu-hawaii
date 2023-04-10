export type MaybeUnknown<A> =
  | { type: "known"; value: A }
  | { type: "unknown"; value: unknown }

export const knownValue = <A>(value: A): MaybeUnknown<A> => ({
  type: "known",
  value,
})
export const unknownValue = <A>(value: unknown): MaybeUnknown<A> => ({
  type: "unknown",
  value,
})
