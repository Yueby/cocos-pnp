import path from "path";
import { getGlobalProjectBuildPath } from "@/global";

export const getSingleFilePath = () => {
  return path.join(getGlobalProjectBuildPath(), '/single-file.html');
};
