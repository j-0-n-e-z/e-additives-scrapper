interface Additive {
  code: string
  name: string
  danger: {
    level: number
    reasons: string[]
  }
  origins: Origin[]
}

type Origin =
  | 'искусственное'
  | 'животное'
  | 'растительное'
  | 'синтетическое'
  | 'биологическое'
  | 'микробиологическое'
  | 'минеральное'
