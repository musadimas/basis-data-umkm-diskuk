<script setup lang="ts">
// /bantuan dulunya halaman FAQ kedua; kini pusat bantuan tunggal ada di /faq
// (keputusan P3-B UI_audit). Halaman ini hanya mengalihkan tautan/bookmark lama.
await navigateTo("/faq", { redirectCode: 302 });
</script>
