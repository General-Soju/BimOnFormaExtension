import { defineConfig } from "vite";

// Forma는 확장을 외부 https URL의 iframe으로 로드한다.
// base를 './'로 두어 GitHub Pages 등 서브경로 호스팅에서도 자산 경로가 깨지지 않게 한다.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
