export function showError(e: unknown) {
  if (e instanceof Error) {
    console.log(`${e.name}: ${e.message}`)
  } else {
    console.log(e)
  }
}

export function isOrigin(origin: unknown): origin is Origin {
  return typeof origin === 'string'
}
