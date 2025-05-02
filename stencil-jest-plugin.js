const { execSync } = require('child_process');
const { dirname } = require('path');

const FILE_TO_LOOK_FOR_TO_KNOW_WE_ARE_IN_A_STENCIL_PROJECT = '**/components.d.ts'; // this is probably not the best way to check if we are in a stencil project, but it works for our example

const stencilJestPlugin = [
  FILE_TO_LOOK_FOR_TO_KNOW_WE_ARE_IN_A_STENCIL_PROJECT,
  files => {
    console.log('files', files);
    const toReturn = [];

    for (const file of files) {
      const projectDir = dirname(file);
      const tests = getTestFiles(projectDir);
      const testTasks = tests.reduce((acc, test) => {
        const testName = test.split('/').pop();
        acc[testName] = {
          command: `npx stencil test --spec -- ${testName.replace(projectDir, '')}`,
        };
        return acc;
      }, {});
      // need to eventually add task to merge coverage
      // const coverageMergeTask = {
      //   command: [`pnpm`, `exec`, `tsx`, `./merge-coverage.ts`, join(someTempCoverageDirectory), theDesiredFinalCoverageDirectory].join(' '),
      //   dependsOn: Object.keys(testTasks),
      // };
      const targets = {
        test: {
          command: 'echo "Tests Atomized"',
          dependsOn: Object.keys(testTasks), // add coverageMergeTask name here when ready
        },
        ...testTasks,
        // combineCoverage: coverageMergeTask,
      };
      const projectResult = {
        projects: {
          [projectDir]: {
            // name: projectDir.replaceAll('/', '-'), // TODO: simple function to name this better
            name: 'stencil-project',
            root: projectDir,
            targets,
          },
        },
      };
      const projectEntry = [file, projectResult];
      toReturn.push(projectEntry);
    }
    return toReturn;
  },
];

function getTestFiles(dir) {
  const result = execSync('npx jest --listTests', { cwd: dir }).toString().split('\n');
  result.pop();
  return result;
}

module.exports = { createNodesV2: stencilJestPlugin };
