"use client";

import { Alert, Button, Stack, Typography } from "@mui/material";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <Stack spacing={2} sx={{ p: 4 }}>
          <Typography variant="h5">The workbench hit a problem</Typography>
          <Alert severity="error">{error.message || "The action could not be completed."}</Alert>
          <Typography variant="body2">Diagnostic detail stays on this screen. Appraisal values are not sent anywhere.</Typography>
          <Button variant="contained" onClick={reset}>Try again</Button>
        </Stack>
      </body>
    </html>
  );
}
