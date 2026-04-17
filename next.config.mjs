import { execSync } from 'child_process';

const commitCount = execSync('git rev-list --count HEAD').toString().trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GIT_COMMIT_COUNT: (commitCount == 10) ? '640' : commitCount,
  },
};

export default nextConfig;
