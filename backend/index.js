const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const OFFICIAL_EMAIL = process.env.OFFICIAL_EMAIL || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const allowedKeys = new Set(["fibonacci", "prime", "lcm", "hcf", "AI"]);
const MAX_ARRAY_LENGTH = 10000;
const MAX_FIB_COUNT = 10000;

function successPayload(data) {
	return { is_success: true, official_email: OFFICIAL_EMAIL, data };
}

function errorPayload(message) {
	return { is_success: false, official_email: OFFICIAL_EMAIL, error: message };
}

function isInteger(value) {
	return Number.isSafeInteger(value);
}

function isIntegerArray(arr) {
	return (
		Array.isArray(arr) &&
		arr.length > 0 &&
		arr.length <= MAX_ARRAY_LENGTH &&
		arr.every(isInteger)
	);
}

function fibonacciSeries(count) {
	const series = [];
	for (let i = 0; i < count; i += 1) {
		if (i === 0) series.push(0);
		else if (i === 1) series.push(1);
		else series.push(series[i - 1] + series[i - 2]);
	}
	return series;
}

function isPrime(num) {
	if (num <= 1) return false;
	if (num === 2) return true;
	if (num % 2 === 0) return false;
	const limit = Math.floor(Math.sqrt(num));
	for (let i = 3; i <= limit; i += 2) {
		if (num % i === 0) return false;
	}
	return true;
}

function gcd(a, b) {
	let x = Math.abs(a);
	let y = Math.abs(b);
	while (y !== 0) {
		const t = y;
		y = x % y;
		x = t;
	}
	return x;
}

function lcm(a, b) {
	return Math.abs(a * b) / gcd(a, b);
}

function lcmArray(arr) {
	return arr.reduce((acc, val) => lcm(acc, val));
}

function hcfArray(arr) {
	return arr.reduce((acc, val) => gcd(acc, val));
}

async function getAiSingleWord(question) {
	if (!GEMINI_API_KEY) {
		throw new Error("GEMINI_API_KEY missing");
	}
	const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
	const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
	// Keep the AI response tiny and forced into one clean word.
	const prompt = `Answer in a single word only. No punctuation. Question: ${question}`;
	const result = await model.generateContent({
		contents: [{ role: "user", parts: [{ text: prompt }] }],
		generationConfig: { maxOutputTokens: 4, temperature: 0.2 }
	});
	const text = result.response.text().trim();
	const first = text.split(/\s+/)[0] || "";
	return first.replace(/^[^\w-]+|[^\w-]+$/g, "") || first;
}

app.get("/health", (req, res) => {
	res.json({ is_success: true, official_email: OFFICIAL_EMAIL });
});

app.post("/bfhl", async (req, res) => {
	try {
		if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
			return res.status(400).json(errorPayload("Invalid JSON body"));
		}

		const keys = Object.keys(req.body);
		if (keys.length !== 1) {
			return res.status(400).json(errorPayload("Provide exactly one key"));
		}

		const key = keys[0];
		if (!allowedKeys.has(key)) {
			return res.status(400).json(errorPayload("Unsupported key"));
		}

		const value = req.body[key];
		// Guardrails keep the API predictable under weird inputs.

		switch (key) {
			case "fibonacci":
				if (!isInteger(value) || value < 1 || value > MAX_FIB_COUNT) {
					return res
						.status(400)
						.json(
							errorPayload(
								`fibonacci must be an integer between 1 and ${MAX_FIB_COUNT}`
							)
						);
				}
				return res.json(successPayload(fibonacciSeries(value)));

			case "prime":
				if (!isIntegerArray(value)) {
					return res
						.status(400)
						.json(
							errorPayload(
								`prime must be a non-empty integer array (max ${MAX_ARRAY_LENGTH})`
							)
						);
				}
				return res.json(successPayload(value.filter(isPrime)));

			case "lcm":
				if (!isIntegerArray(value) || value.some((v) => v < 1)) {
					return res
						.status(400)
						.json(
							errorPayload(
								`lcm must be a non-empty array of integers >= 1 (max ${MAX_ARRAY_LENGTH})`
							)
						);
				}
				return res.json(successPayload(lcmArray(value)));

			case "hcf":
				if (!isIntegerArray(value) || value.some((v) => v < 1)) {
					return res
						.status(400)
						.json(
							errorPayload(
								`hcf must be a non-empty array of integers >= 1 (max ${MAX_ARRAY_LENGTH})`
							)
						);
				}
				return res.json(successPayload(hcfArray(value)));

			case "AI":
				if (typeof value !== "string" || !value.trim()) {
					return res
						.status(400)
						.json(errorPayload("AI must be a non-empty string"));
				}
				return res.json(successPayload(await getAiSingleWord(value.trim())));

			default:
				return res.status(400).json(errorPayload("Unsupported key"));
		}
	} catch (error) {
		return res.status(500).json(errorPayload("Internal server error"));
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
