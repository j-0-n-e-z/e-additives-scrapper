import fs from 'fs'
import puppeteer from 'puppeteer'

const url = 'https://dobavkam.net/additives'

getAdditives(url)

async function getAdditives(url) {
	const browser = await puppeteer.launch({ headless: 'new' })
	const page = await browser.newPage()

	await page.goto(url, { waitUntil: 'domcontentloaded' })

	let loadMoreButton = await page.$('.pager__item')
	loadMoreButton.click()

	await page
		.waitForSelector('.pager__item', { timeout: 4000, hidden: true })
		.catch(e => console.log(e))

	const originElements = await page.$$('.term--additive-origins')

	const allOrigins = {}
	for (const originElement of originElements) {
		const number = await originElement.evaluate(el => el.classList[1].slice(-2))
		const origin = await originElement.evaluate(el =>
			el.innerText.toLowerCase()
		)
		allOrigins[number] = origin.trim()
	}

	console.log('origins', allOrigins)

	let adds = []
	const moreDetailsLinks = []
	let addElements = await page.$$('.addicon')

	for (const addElement of addElements) {
		const danger = await addElement.evaluate(el => +el.classList[1].at(-1))

		const originElements = await addElement.$$('.addicon__origin-item')
		const origins = []
		for (const originElement of originElements) {
			const originNumber = await originElement.evaluate(el =>
				el.classList[1].slice(-2)
			)
			origins.push(allOrigins[originNumber])
		}

		const [code, name, moreDetailsLink] = await addElement.$eval(
			'.addicon__link',
			node => [...node.innerText.split(' – '), node.getAttribute('href')]
		)

		moreDetailsLinks.push(moreDetailsLink)
		adds.push({
			code,
			name: name.toLowerCase(),
			danger: { level: danger },
			origins
		})
	}

	const dangerReasons = []
	for (const moreDetailsLink of moreDetailsLinks) {
		// works only with these options and I have no idea why
		await page.goto(moreDetailsLink, {
			timeout: 0,
			waitUntil: 'domcontentloaded'
		})

		const dangerReason = await page.$('h3.poor')
		if (dangerReason) {
			const dangerReasonParagraphs = []
			let next = await dangerReason.evaluateHandle(el => el.nextElementSibling)
			if (next) {
				let nextText = await next.evaluate(el => el.textContent)
				while (!nextText.startsWith('Использование') && !nextText.startsWith('Польза')) {
					dangerReasonParagraphs.push(nextText)
					next = await next.evaluateHandle(el => el.nextElementSibling)
					nextText = await next.evaluate(el => el.textContent)
				}
			}
			dangerReasons.push(dangerReasonParagraphs)
		} else {
			dangerReasons.push([])
		}
	}

	adds = adds.map((add, i) => ({
		...add,
		danger: { ...add.danger, reasons: dangerReasons[i] }
	}))

	console.log('additives', adds)

	if (adds.length) {
		fs.writeFileSync('additives.json', JSON.stringify(adds), e =>
			console.log(e)
		)
	}

	await browser.close()
}
