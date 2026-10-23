# syntax=docker/dockerfile:1
# Keep the existing PostgreSQL major, Alpine family and data directory.
FROM postgres:17-alpine AS extension
ADD --checksum=sha256:a9094dfb85ccdde3cbb295f1086d4c71a20db1d26bf1d6c39f07a7d164033eb4 https://codeload.github.com/pgvector/pgvector/tar.gz/refs/tags/v0.8.1 /tmp/pgvector.tar.gz
RUN apk add --no-cache build-base \
    && tar -xzf /tmp/pgvector.tar.gz -C /tmp \
    && cd /tmp/pgvector-0.8.1 \
    && make OPTFLAGS="" with_llvm=no \
    && make install DESTDIR=/extension with_llvm=no \
    && mkdir -p /extension/usr/share/doc/pgvector \
    && cp LICENSE README.md /extension/usr/share/doc/pgvector/

FROM postgres:17-alpine
LABEL org.opencontainers.image.source="https://github.com/Fristail27/vocab-bloom-hub" \
      org.opencontainers.image.description="Vocab Bloom Hub PostgreSQL 17 Alpine with pgvector" \
      org.opencontainers.image.licenses="PostgreSQL"
COPY --from=extension /extension/ /
# Installing the files does not create the extension in any database.
# Operators enable it explicitly; ordinary storage and lexical search need none.
