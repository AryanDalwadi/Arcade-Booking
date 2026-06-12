import { useState } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import InventoryIcon from "@mui/icons-material/Inventory";
import LogoutIcon from "@mui/icons-material/Logout";
import GroupIcon from "@mui/icons-material/Group";
import PeopleIcon from "@mui/icons-material/People";
import ReceiptIcon from "@mui/icons-material/Receipt";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import logo from "../assets/game-galaxy-logo.png";

const drawerWidth = 240;

const menuItems = [
  { label: "Dashboard", path: "/", icon: <DashboardIcon /> },
  { label: "Product List", path: "/products", icon: <InventoryIcon /> },
  { label: "User List", path: "/users", icon: <PeopleIcon /> },
  { label: "User Groups", path: "/user-groups", icon: <GroupIcon /> },
  { label: "Billing Screen", path: "/billing", icon: <ReceiptIcon /> },
  { label: "Purchase Screen", path: "/purchase", icon: <ShoppingCartIcon /> },
];

const getInitial = (name) => name?.trim().charAt(0).toUpperCase() || "?";

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate("/login");
  };

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              cursor: "pointer",
            }}
            onClick={() => navigate("/")}
          >
            <Box
              component="img"
              src={logo}
              alt="Arcade Booking"
              sx={{ height: 36, width: "auto" }}
            />
            <Typography variant="h6" noWrap component="div">
              Game Galaxy Plus
            </Typography>
          </Box>

          {user && (
            <>
              <IconButton
                onClick={(event) => setAnchorEl(event.currentTarget)}
                sx={{ p: 0 }}
                aria-label="Account menu"
                aria-controls={menuOpen ? "account-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={menuOpen ? "true" : undefined}
              >
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: "#18181b",
                    fontWeight: 700,
                    fontSize: "1rem",
                  }}
                >
                  {getInitial(user.name)}
                </Avatar>
              </IconButton>

              <Menu
                id="account-menu"
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                  paper: {
                    sx: { minWidth: 200, mt: 1 },
                  },
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {user.name}
                  </Typography>
                  {user.email && (
                    <Typography variant="body2" color="text.secondary">
                      {user.email}
                    </Typography>
                  )}
                </Box>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  Logout
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar />
        <List>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.path}
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;
