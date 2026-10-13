#![no_main]

use libfuzzer_sys::fuzz_target;

// The whole native reader (archive, object stream, model) and the preview, on arbitrary bytes.
fuzz_target!(|data: &[u8]| {
    let _ = coolphoto_affinity::container::header(data);
    let _ = coolphoto_affinity::preview(data);
    let _ = coolphoto_affinity::read(data, coolphoto_affinity::Limits { max_entry: 16 << 20, max_total: 64 << 20 });
});
