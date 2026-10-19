//! User ids are UUID strings; swarms store a 4-byte index instead.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::swarms::Owner;

#[derive(Default)]
pub struct Owners {
    inner: RwLock<Inner>,
}

#[derive(Default)]
struct Inner {
    by_id: HashMap<Arc<str>, Owner>,
    ids: Vec<Arc<str>>,
}

impl Owners {
    pub fn intern(&self, user_id: &Arc<str>) -> Owner {
        if let Some(&owner) = self.read().by_id.get(user_id) {
            return owner;
        }
        let mut inner = self.inner.write().unwrap_or_else(|p| p.into_inner());
        if let Some(&owner) = inner.by_id.get(user_id) {
            return owner;
        }
        let owner = inner.ids.len() as Owner;
        inner.ids.push(user_id.clone());
        inner.by_id.insert(user_id.clone(), owner);
        owner
    }

    pub fn user_id(&self, owner: Owner) -> Option<Arc<str>> {
        self.read().ids.get(owner as usize).cloned()
    }

    fn read(&self) -> std::sync::RwLockReadGuard<'_, Inner> {
        self.inner.read().unwrap_or_else(|p| p.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interns_once() {
        let owners = Owners::default();
        let a: Arc<str> = Arc::from("user-a");
        let b: Arc<str> = Arc::from("user-b");
        assert_eq!(owners.intern(&a), 0);
        assert_eq!(owners.intern(&b), 1);
        assert_eq!(owners.intern(&Arc::from("user-a")), 0);
        assert_eq!(owners.user_id(1).as_deref(), Some("user-b"));
        assert_eq!(owners.user_id(7), None);
    }
}
