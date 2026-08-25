export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Server Error</title></head>
  <body><h1>Something went wrong</h1><p>Please refresh and try again.</p></body>
</html>`;
}
