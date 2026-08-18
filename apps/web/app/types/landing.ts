export interface Product {
  id: number
  owner: string
  name: string
  location: string
  image: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface TermItem {
  title: string
  items: string[]
}

export interface NavLink {
  label: string
  to: string
}

export interface SocialLink {
  label: string
  href: string
}
