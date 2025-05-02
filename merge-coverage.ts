/**
 * THIS SCRIPT IS COPIED AND PASTED FROM OTHER EXAMPLES WE'VE USED IN THE PAST
 * MAY NEED SOME REFACTORING AND IRONING OUT TO MAKE IT WORK PROPERLY
 * SEE COMMENTED MERGECOVERAGETASK IN STENCIL-JEST-PLUGIN FOR WHERE IT SHOULD BE USED
 */

/* eslint-disable no-console */
import { exec, execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

const COVERAGE_DIR = process.argv[2];
const TARGET_LOCATION = process.argv[3] || COVERAGE_DIR;

type FileProcessInfo = 'unbatched' | 'batched' | 'working';
const processBatchData: Record<string, FileProcessInfo> = {};
const BATCH_SIZE = 10;
const MAX_BATCH_COUNT = 10;

async function processLcov() {
  updateDirectoryInfo();
  if (Object.entries(processBatchData).length < BATCH_SIZE) {
    await processBatch(Object.keys(processBatchData));
    const directories = readdirSync(COVERAGE_DIR, { withFileTypes: true })
      .filter(result => result.isDirectory())
      .map(dirent => dirent.name);
    if (directories.length !== 1) {
      console.error(`Something went wrong, expected 1 directory, found ${directories.length}`);
      return;
    }
    const finalDir = directories[0];
    if (!existsSync(TARGET_LOCATION)) {
      mkdirSync(TARGET_LOCATION, { recursive: true });
    }
    execSync(`mv ${join(COVERAGE_DIR, finalDir, 'coverage-final.json')} ${join(TARGET_LOCATION, 'coverage-final.json')}`);
    execSync(`rm -rf ${join(COVERAGE_DIR, finalDir)}`);
  } else {
    const batches = createBatches();
    await Promise.all(batches.filter((_, i) => i < MAX_BATCH_COUNT).map(processBatch));
    await processLcov();
  }
}

async function processBatch(batch: string[]): Promise<void> {
  if (batch.length === 0) {
    return;
  }

  for (const dir of batch) {
    processBatchData[dir] = 'working';
  }
  const batchName = join(uuid(), `coverage-final.json`);
  console.log(`====== NOW MERGING Batch ${batchName} ======`);
  for (const dir of batch) {
    console.log(`    - ${dir}`);
  }
  console.log(`================================`);
  await new Promise<void>((res, rej) => {
    exec(
      [`pnpm`, `exec`, `istanbul-merge`, `--out=${join(COVERAGE_DIR, batchName)}`, ...batch.map(directory => join(COVERAGE_DIR, directory, `coverage-final.json`))].join(' '),
      error => {
        if (error) {
          rej(error);
        }
        res();
      },
    );
  });
  await deleteFiles(batch.map(directory => join(COVERAGE_DIR, directory)));
  console.log(`====== Batch ${batchName} COMPLETE! ========`);
  for (const dir of batch) {
    delete processBatchData[dir];
  }
}

function createBatches(): string[][] {
  const batches: string[][] = [];
  let count = 0;
  let currArr: string[];
  for (const dir of Object.keys(processBatchData)) {
    if (count === 0) {
      currArr = [dir];
      batches.push(currArr);
      count++;
    } else if (count === BATCH_SIZE) {
      currArr?.push(dir);
      count = 0;
    } else {
      currArr?.push(dir);
      count++;
    }
  }
  return batches;
}

function updateDirectoryInfo() {
  const directories = readdirSync(COVERAGE_DIR, { withFileTypes: true })
    .filter(result => result.isDirectory())
    .map(dirent => dirent.name);
  for (const dir of directories) {
    if (!processBatchData[dir]) {
      processBatchData[dir] = 'unbatched';
    }
  }
}

async function deleteFiles(files: string[]): Promise<void> {
  console.log(`Deleting files: ${files}`);
  await Promise.all(files.map(deleteFile));
}

const RETRY_LIMIT = 5;

async function deleteFile(file: string, retryCount = 0): Promise<void> {
  try {
    await new Promise<void>((res, rej) => {
      exec(`rm -rf ${file}`, error => {
        if (error) {
          rej(error);
        }
        res();
      });
    });
  } catch (e) {
    if (retryCount < RETRY_LIMIT) {
      console.error(`Error deleting directory ${file}. Retrying...`, e);
      await deleteFile(file, retryCount + 1);
    } else {
      console.error(`Error deleting directory ${file}. Max retries reached.`, e);
      throw e;
    }
  }
}

const start = performance.now();

processLcov().finally(() => {
  console.log(`Processing Completed in ${performance.now() - start}ms`);
});
