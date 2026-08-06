# Control Tower

A static web dashboard (cashflow / performance / forecast / costs) served by a
minimal Node.js HTTP server.

## Run with Docker

Docker has specific installation instructions for each operating system.
Refer to the official documentation at https://docker.com/get-started/.

Build the image:

```bash
docker build -t control-tower .
```

Run the container:

```bash
docker run -it --rm -p 8080:8080 control-tower
```

The app is then available at http://localhost:8080.

### Using the base Node.js image directly

```bash
# Pull the Node.js Docker image
docker pull node:24-slim

# Create a Node.js container and start a shell session
docker run -it --rm --entrypoint sh node:24-slim

# Verify Node.js version
node -v # v24.19.0

# Verify npm version
npm -v # 11.17.0
```

## Run without Docker

```bash
npm install
npm start
```
