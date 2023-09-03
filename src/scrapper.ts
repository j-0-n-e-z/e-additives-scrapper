import fs from 'fs'
import puppeteer, { ElementHandle, Page } from 'puppeteer'
import { ADDITIVES_URL } from './constants'

interface Additive {
	code: string
	name: string
	danger: {
		level: number
		reasons: string[]
	}
	origins: string[]
}

getAdditives(ADDITIVES_URL)

async function getAdditives(url: string) {
	const browser = await puppeteer.launch({ headless: false })
	const page = await browser.newPage()

	try {
		await page.goto(url, { waitUntil: 'domcontentloaded' })

		const loadMoreButton = await page.$('.pager__item')
		if (loadMoreButton) {
			loadMoreButton.click()
			await page.waitForSelector('.pager__item', {
				timeout: 4000,
				hidden: true
			})
		}

		const origins = await scrapOrigins(page)
		// console.log('@origins', origins)

		const [additivesWithNoDangerReason, additiveLinks] = await scrapAdditives(
			page,
			origins
		)
		// console.log('@additive_links', additiveLinks)

		const dangerReasons = await scrapDangerReasons(page, additiveLinks)
		console.log('@danger', dangerReasons)

		const additives = additivesWithNoDangerReason.map((add, idx) => ({
			...add,
			danger: { ...add.danger, reasons: dangerReasons?.[idx] ?? [] }
		}))
		// console.log('@additives', additives)

		if (additives?.length) {
			fs.writeFile('additives.json', JSON.stringify(additives), err => {})
		}
	} catch (e) {
		showError(e)
	} finally {
		await browser.close()
	}
}

async function scrapOrigins(page: Page) {
	const origins: Record<string, string> = {}
	const originElements = await page.$$('.term--additive-origins')
	//TODO:add try catch
	for (const originElement of originElements) {
		const key = await originElement.evaluate(el => el.classList[1].slice(-2))
		const origin = await originElement.evaluate(
			el => el.textContent?.toLowerCase() || ''
		)
		origins[key] = origin.trim()
	}

	return origins
}

async function scrapAdditives(
	page: Page,
	origins: Record<string, string>
): Promise<[Additive[], string[]]> {
	const additiveLinks: string[] = []
	const additiveElements = await page.$$('.addicon')
	const additives: Additive[] = []

	for (const additiveElement of additiveElements) {
		const dangerLevel = await additiveElement.evaluate(el =>
			Number(el.classList[1].at(-1))
		)

		const additiveOrigins = []
		const originElements = await additiveElement.$$('.addicon__origin-item')
		for (const originElement of originElements) {
			const key = await originElement.evaluate(el => el.classList[1].slice(-2))
			additiveOrigins.push(origins[key])
		}

		try {
			const [code, name, additiveLink] = await additiveElement.$eval(
				'.addicon__link',
				node => [
					...(node.textContent ?? '').split(' – '),
					node.getAttribute('href')
				]
			)

			if (!code) throw new Error('Code was not found')
			if (!name) throw new Error('Name was not found')
			if (!additiveLink) throw new Error('Additive link was not found')

			additiveLinks.push(additiveLink)
			additives.push({
				code,
				name: name.toLowerCase(),
				danger: { level: dangerLevel, reasons: [] },
				origins: additiveOrigins
			})
		} catch (e) {
			showError(e)
		}
	}

	return [additives, additiveLinks]
}

async function scrapDangerReasons(page: Page, additiveLinks: string[]) {
	const dangerReasons: string[][] = []

	try {
		for (const additiveLink of additiveLinks) {
			await page.goto(additiveLink, {
				timeout: 0,
				waitUntil: 'domcontentloaded'
			})

			let dangerReason = await page.$('h3.poor')

			if (dangerReason) {
				const dangerReasonParagraphs = []

				let next = await dangerReason.evaluateHandle(
					el => el.nextElementSibling
				)
				if (next) {
					let nextText = await (next as ElementHandle<Element>).evaluate(
						el => el?.textContent,
						next
					)
					console.log(nextText)
					while (nextText && !/^(Использование|Польза)/.test(nextText)) {
						if (nextText) {
							dangerReasonParagraphs.push(nextText)
						}
						next = await (next as ElementHandle<Element>).evaluateHandle(
							el => el?.nextElementSibling
						)
						nextText = await (next as ElementHandle<Element>).evaluate(
							el => el.textContent
						)
					}
				}

				dangerReasons.push(dangerReasonParagraphs)
			}
		}
	} catch (e) {
		showError(e)
	}

	return dangerReasons
}

function showError(e: unknown) {
	if (typeof e === typeof Error) {
		// console.log((e as Error).message)
	} else if (typeof e === 'string') {
		// console.log(e)
	}
}
