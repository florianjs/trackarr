//! Minimal bencode encoder: trackers only ever write responses.

/// A bencode value. Dictionaries keep their keys sorted, as the spec requires.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Value {
    Int(i64),
    Bytes(Vec<u8>),
    List(Vec<Value>),
    Dict(Vec<(Vec<u8>, Value)>),
}

impl Value {
    pub fn str(s: &str) -> Self {
        Value::Bytes(s.as_bytes().to_vec())
    }

    /// Build a dictionary; keys are sorted as raw bytes.
    pub fn dict<K: AsRef<[u8]>>(entries: impl IntoIterator<Item = (K, Value)>) -> Self {
        let mut entries: Vec<(Vec<u8>, Value)> = entries
            .into_iter()
            .map(|(k, v)| (k.as_ref().to_vec(), v))
            .collect();
        entries.sort_by(|a, b| a.0.cmp(&b.0));
        Value::Dict(entries)
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        self.encode_into(&mut out);
        out
    }

    fn encode_into(&self, out: &mut Vec<u8>) {
        match self {
            Value::Int(n) => {
                out.push(b'i');
                out.extend_from_slice(n.to_string().as_bytes());
                out.push(b'e');
            }
            Value::Bytes(bytes) => encode_bytes(bytes, out),
            Value::List(items) => {
                out.push(b'l');
                for item in items {
                    item.encode_into(out);
                }
                out.push(b'e');
            }
            Value::Dict(entries) => {
                out.push(b'd');
                for (key, value) in entries {
                    encode_bytes(key, out);
                    value.encode_into(out);
                }
                out.push(b'e');
            }
        }
    }
}

fn encode_bytes(bytes: &[u8], out: &mut Vec<u8>) {
    out.extend_from_slice(bytes.len().to_string().as_bytes());
    out.push(b':');
    out.extend_from_slice(bytes);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_scalars() {
        assert_eq!(Value::Int(42).encode(), b"i42e");
        assert_eq!(Value::Int(-3).encode(), b"i-3e");
        assert_eq!(Value::str("spam").encode(), b"4:spam");
        assert_eq!(Value::Bytes(vec![]).encode(), b"0:");
    }

    #[test]
    fn encodes_lists() {
        let list = Value::List(vec![Value::str("a"), Value::Int(1)]);
        assert_eq!(list.encode(), b"l1:ai1ee");
    }

    #[test]
    fn sorts_dict_keys() {
        let dict = Value::dict([
            ("interval", Value::Int(600)),
            ("complete", Value::Int(1)),
            ("incomplete", Value::Int(2)),
        ]);
        assert_eq!(
            dict.encode(),
            b"d8:completei1e10:incompletei2e8:intervali600ee"
        );
    }

    #[test]
    fn binary_keys_and_values() {
        let dict = Value::dict([(vec![0xffu8, 0x00], Value::Bytes(vec![0x01, 0x02]))]);
        assert_eq!(
            dict.encode(),
            [b'd', b'2', b':', 0xff, 0x00, b'2', b':', 0x01, 0x02, b'e']
        );
    }
}
