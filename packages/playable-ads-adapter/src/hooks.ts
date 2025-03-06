import { initBuildFinishedEvent, initBuildStartEvent } from '@/extensions/builder/3x';
import { IBuildResult, IBuildTaskOption } from '~types/packages/builder/@types';

export function onBeforeBuild(options: IBuildTaskOption) {

	initBuildStartEvent(options);
}

export function onAfterBuild(options: IBuildTaskOption, _result: IBuildResult) {
	initBuildFinishedEvent(options);
}
