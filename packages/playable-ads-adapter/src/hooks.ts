import { initBuildFinishedEvent, initBuildStartEvent } from '@/extensions/builder';
import { IBuildResult, IBuildTaskOption } from '~types/packages/builder/@types';

export function onBeforeBuild(options: IBuildTaskOption) {
	console.log('onBeforeBuild', options);
	return initBuildStartEvent(options);
}

export function onAfterBuild(options: IBuildTaskOption, _result: IBuildResult) {
	console.log('onAfterBuild', options, _result);
	return initBuildFinishedEvent(options);
}
