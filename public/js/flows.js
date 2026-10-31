// Mirror of the server-side state machine (the server is the authority and re-validates every change)
export const FLOWS = {
  delivery: ['pending', 'accepted', 'preparing', 'out_for_delivery', 'completed'],
  restaurant: ['pending', 'accepted', 'preparing', 'ready', 'completed']
};
