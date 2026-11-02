FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/whatsmeow-sidecar .

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin syndes
COPY --from=build /out/whatsmeow-sidecar /usr/local/bin/whatsmeow-sidecar
USER 10001:10001
ENTRYPOINT ["/usr/local/bin/whatsmeow-sidecar"]
