import fs from 'fs'

import type { Page } from 'puppeteer'
import puppeteer from 'puppeteer'

import { ADDITIVES_URL } from './constants'
import { isOrigin, showError } from './helpers'

async function scrapOrigins(page: Page) {
  const origins: Record<string, Origin> = {}

  try {
    const originElements = await page.$$('.term--additive-origins')

    if (!originElements.length) throw new Error('No origin elements found')

    for (const originElement of originElements) {
      const key = await originElement.evaluate((el) => el.classList[1].slice(-2))
      const fullOrigin = await originElement.evaluate((el) => el.textContent?.toLowerCase() ?? '') // ex: "растительное происхождение"

      const [origin] = fullOrigin.trim().split(' ')
      if (isOrigin(origin)) {
        origins[key] = origin
      }
    }
  } catch (e) {
    showError(e)
  }

  return origins
}

async function scrapAdditives(
  page: Page,
  origins: Record<string, Origin>
): Promise<[Additive[], string[]]> {
  const additiveLinks: string[] = []
  const additives: Additive[] = []

  try {
    const additiveElements = await page.$$('.addicon')

    if (!additiveElements.length) throw new Error('No additive elements found')

    for (const additiveElement of additiveElements) {
      const dangerLevel = await additiveElement.evaluate((el) => Number(el.classList[1].at(-1)))

      const additiveOrigins: Origin[] = []
      const additiveOriginElements = await additiveElement.$$('.addicon__origin-item')

      for (const additiveOriginElement of additiveOriginElements) {
        const key = await additiveOriginElement.evaluate((el) => el.classList[1].slice(-2))
        if (key in origins) {
          additiveOrigins.push(origins[key])
        }
      }

      const [code, name, additiveLink] = await additiveElement.$eval('.addicon__link', (node) => {
        const additiveTitle = node.textContent ?? '' // ex: "E621 – глутамат натрия"
        return [...additiveTitle.split(' – '), node.getAttribute('href')]
      })

      if (code && name && additiveLink) {
        additiveLinks.push(additiveLink)
        additives.push({
          code,
          danger: { level: dangerLevel, reasons: [] },
          name: name.toLowerCase(),
          origins: additiveOrigins
        })
      }
    }
  } catch (e) {
    showError(e)
  }

  return [additives, additiveLinks]
}

async function scrapDangerReasons(page: Page, additiveLinks: string[]) {
  const dangerReasons: string[][] = []

  try {
    for (const additiveLink of additiveLinks) {
      await page.goto(additiveLink, {
        waitUntil: 'domcontentloaded'
      })

      const dangerReasonParagraphs = []

      const dangerReason = await page.$('h3.poor')
      if (dangerReason) {
        let nextElement = await dangerReason.evaluateHandle((el) => el.nextElementSibling)
        let nextElementText = await page.evaluate((el) => el?.textContent, nextElement)
        console.log(nextElementText)

        while (nextElementText && !/^(Использование|Польза)/.test(nextElementText)) {
          dangerReasonParagraphs.push(nextElementText)
          nextElement = await page.evaluateHandle(
            (el) => el?.nextElementSibling ?? null,
            nextElement
          )
          nextElementText = await page.evaluate((el) => el?.textContent, nextElement)
        }
      }

      dangerReasons.push(dangerReasonParagraphs)
    }
  } catch (e) {
    showError(e)
  }

  return dangerReasons
}

async function getAdditives(page: Page, url: string) {
  let additives: Additive[] = []

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    const loadMoreButton = await page.$('.pager__item')
    if (loadMoreButton) {
      loadMoreButton.click()
      await page.waitForSelector('.pager__item', {
        hidden: true,
        timeout: 1500
      })
    }

    const origins = await scrapOrigins(page)
    console.log('@origins', origins)

    const [additivesWithEmptyDangerReasons, additiveLinks] = await scrapAdditives(page, origins)
    console.log('@additiveLinks', additiveLinks)

    const dangerReasons = await scrapDangerReasons(page, additiveLinks)
    console.log('@danger', dangerReasons)

    if (additivesWithEmptyDangerReasons.length !== dangerReasons.length)
      throw new Error('Additives count must be equal to danger reasons count')

    additives = additivesWithEmptyDangerReasons.map((additive, idx) => ({
      ...additive,
      danger: { ...additive.danger, reasons: dangerReasons[idx] }
    }))
    console.log('@additives', additives)
  } catch (e) {
    showError(e)
  }

  return additives
}

function saveAdditives(additives: Additive[]) {
  try {
    if (additives?.length) {
      fs.writeFile('additives.json', JSON.stringify(additives), (err) => {
        if (!err) console.log('File saved')
        else showError(err)
      })
    } else {
      throw new Error('There are no additives to save')
    }
  } catch (e) {
    showError(e)
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()

  const additives = await getAdditives(page, ADDITIVES_URL)
  saveAdditives(additives)

  await browser.close()
}

main()
