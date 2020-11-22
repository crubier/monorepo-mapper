import { spawn } from 'child_process';
import { outputFile } from 'fs-extra';
import { Digraph } from 'graphviz-node';
import { Argv } from './argv';

export function writeDotOutput(
	argv: Argv & { location: string },
	mainGraph: Digraph
) {
	try {
		outputFile(
			`${argv.location}/${argv.outputPath}.dot`,
			mainGraph.toDot(),
			{ encoding: 'utf8' },
			() => {
				// mainGraph.render(argv.outputPath);
				const ls = spawn(`${argv.graphvizDirectory}`, [
					`${argv.location}/${argv.outputPath}.dot`,
					`-T${argv.outputFormat}`,
					`-o`,
					`${argv.location}/${argv.outputPath}.${argv.outputFormat}`,
				]);

				ls.stdout.on('data', (data) => {
					console.log(`stdout: ${data}`);
				});

				ls.stderr.on('data', (data) => {
					console.error(`stderr: ${data}`);
				});

				ls.on('close', (code) => {
					if (code !== 0) {
						console.log(`child process exited with code ${code}`);
					}
				});
				// console.log(
				// 	`Processed ${argv.focus} : ${argv.location}/${argv.outputPath}.${argv.outputFormat}`
				// );
			}
		);
	} catch (e) {
		console.error(e);
		console.log(
			`You need to install graphviz, and have the "dot" executable in your PATH`
		);
	}
}
