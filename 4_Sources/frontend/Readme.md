# initial readmne file

# Команды для запуска
```
cd 4_Sources\frontend
npm install
npm run dev
```

## Media and chat dates

- Set `VITE_API_BASE_URL=/api` for same-origin proxying or an absolute API URL such as `https://api.elephantaimessenger.ru/api`.
- Avatars and message images are normalized before rendering, so `/media/...` links and internal Docker media hosts resolve to the browser-visible API origin.
- The chat feed shows date separators between messages from different days.
