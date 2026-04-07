export interface EONETEvent {
  id: string
  title: string
  description: string
  link: string
  closed: string | null
  categories: Array<{ id: string; title: string }>
  sources: Array<{ id: string; url: string }>
  geometry: Array<{
    magnitudeValue: number | null
    magnitudeUnit: string | null
    date: string
    type: string
    coordinates: [number, number]
  }>
}

export interface EONETResponse {
  title: string
  description: string
  link: string
  events: EONETEvent[]
}

export interface UserImage {
  id: string
  eventId: string
  userId: string
  username: string
  filename: string
  originalName: string
  caption: string
  createdAt: string
}

export interface User {
  id: string
  username: string
  token: string
}
