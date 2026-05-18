export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (password === 'Grammie1926') {
    // Set auth cookie — expires in 30 days
    res.setHeader('Set-Cookie', `ti-auth=authenticated; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Incorrect password' });
}
