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

	console.log(allOrigins)

	const adds = []
	const addElements = await page.$$('.addicon')

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

		const [code, name] = await addElement.$eval('.addicon__link', node =>
			node.innerText.split(' – ')
		)

		adds.push({ id: code, code, name: name.toLowerCase(), danger, origins })
	}

	console.log(adds)

	if (adds.length) {
		fs.writeFileSync('additives.json', JSON.stringify(adds), e =>
			console.log(e)
		)
	}

	await browser.close()
}
