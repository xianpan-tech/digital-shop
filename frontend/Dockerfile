FROM node:20-alpine
WORKDIR /app
COPY package.json ./
# 国内服务器直连 registry.npmjs.org 容易卡死，统一走 npmmirror 镜像源
RUN npm config set registry https://registry.npmmirror.com
# 构建需要 devDependencies 里的 tailwindcss / postcss / autoprefixer，不能用 --omit=dev，否则 npm run build 会报 Cannot find module 'tailwindcss'
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
