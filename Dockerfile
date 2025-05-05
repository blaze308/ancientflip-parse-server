FROM parseplatform/parse-server:latest

# Set Parse Server environment variables
ENV PARSE_SERVER_APPLICATION_ID=A8910qm5BYBajmEt8zONLLSgv7IhgWUI0aPTwsbV
ENV PARSE_SERVER_MASTER_KEY=gZOAivmFs42VSfzczvDuQ0dlCOGJP4g3KbzbK3PM
ENV PARSE_SERVER_DATABASE_URI=mongodb+srv://admin:admin@e2e-test-db.vkml0lr.mongodb.net/ancientflip-test-db?retryWrites=true&w=majority
ENV PORT=1337

# Mount volume for configuration
VOLUME /parse-server/config

# Expose the Parse Server port
EXPOSE 1337

# The command will be inherited from the base image 