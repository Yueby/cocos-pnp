import { initBuildFinishedEvent, initBuildStartEvent } from '@/extensions/builder';
import { logger } from '@/extensions/logger';
import { IBuildResult, IBuildTaskOption } from '~types/packages/builder/@types';

export function onBeforeBuild(options: IBuildTaskOption) {
	logger.debug('onBeforeBuild', options);
	return initBuildStartEvent(options);
}

export function onAfterBuild(options: IBuildTaskOption, _result: IBuildResult) {
	logger.debug('onAfterBuild', options, _result);
	return initBuildFinishedEvent(options);
}
