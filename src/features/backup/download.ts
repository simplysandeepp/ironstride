/** Saves text as a file through the browser. Works offline; nothing is uploaded anywhere. */
export function downloadTextFile(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const backupFilename = (now: Date = new Date()) =>
  `ironstride-backup-${now.toISOString().slice(0, 10)}.json`
