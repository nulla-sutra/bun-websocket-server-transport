import { fromThrowable } from "neverthrow";
import { SerializationError } from "./error";

const safeSerialize = fromThrowable(
  JSON.stringify,
  (cause) => SerializationError.ENCODE_FAILED().with({ cause })
);